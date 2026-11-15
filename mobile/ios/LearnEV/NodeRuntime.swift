import Foundation
import NodeMobile
import Security

/// Runs the LearnEV server (runtime/server.mjs in the app bundle) on a background thread.
/// Node.js can start only once per process, so the server lives as long as the app does.
final class NodeRuntime {
    struct Failure: Error { let message: String }

    static let shared = NodeRuntime()
    /// The session cookie value; the server answers only requests that carry it.
    let token: String
    /// Called on the main queue if Node.js stops after the server was ready.
    var onExit: ((String) -> Void)?

    private var waiters: [(Result<Int, Failure>) -> Void] = []
    private var outcome: Result<Int, Failure>?
    private var started = false
    private var exitStatus: Int32?

    private init() {
        var bytes = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess)
        token = bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Calls back on the main queue with the server's port once it listens.
    func start(_ done: @escaping (Result<Int, Failure>) -> Void) {
        dispatchPrecondition(condition: .onQueue(.main))
        if let outcome { return done(outcome) }
        waiters.append(done)
        guard !started else { return }
        started = true
        do { try launch() } catch { finish(.failure(Failure(message: error.localizedDescription))) }
    }

    private func launch() throws {
        let files = FileManager.default
        guard let runtime = Bundle.main.url(forResource: "runtime", withExtension: nil) else {
            throw Failure(message: "The app bundle has no runtime folder.")
        }
        var base = try files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("LearnEV", isDirectory: true)
        let work = base.appendingPathComponent("learnev", isDirectory: true)
        try files.createDirectory(at: work, withIntermediateDirectories: true)
        // Provider keys live here too; like the Android app, keep them out of device backups.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try base.setResourceValues(values)
        let ready = files.temporaryDirectory.appendingPathComponent("learnev-ready")
        try? files.removeItem(at: ready)

        let environment = [
            "NODE_ENV": "production",
            "LEARNEV_SESSION": token,
            "LEARNEV_DATA_DIR": base.appendingPathComponent("state").path,
            "PI_CODING_AGENT_DIR": base.appendingPathComponent("pi").path,
            // Reusing the port keeps the page's origin, and with it the UI's local storage.
            "LEARNEV_PORT": String(UserDefaults.standard.integer(forKey: "port")),
            "LEARNEV_READY_FILE": ready.path,
        ]
        for (name, value) in environment { setenv(name, value, 1) }
        guard files.changeCurrentDirectoryPath(work.path) else { throw Failure(message: "Cannot open \(work.path).") }

        let server = runtime.appendingPathComponent("server.mjs").path
        let thread = Thread { [weak self] in
            let status = Self.runNode(["node", server])
            DispatchQueue.main.async { self?.exited(status) }
        }
        thread.name = "learnev-node"
        thread.stackSize = 16 << 20
        thread.start()
        waitForReady(ready, until: Date().addingTimeInterval(180))
    }

    private func waitForReady(_ file: URL, until deadline: Date) {
        if outcome != nil { return }
        if let text = try? String(contentsOf: file, encoding: .utf8), let port = Int(text), port > 0 {
            UserDefaults.standard.set(port, forKey: "port")
            return finish(.success(port))
        }
        if let exitStatus { return finish(.failure(Failure(message: "Node.js exited with status \(exitStatus)."))) }
        if Date() > deadline { return finish(.failure(Failure(message: "The server did not start in time."))) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.waitForReady(file, until: deadline) }
    }

    private func exited(_ status: Int32) {
        exitStatus = status
        if case .success = outcome { onExit?("Node.js exited with status \(status).") }
    }

    private func finish(_ result: Result<Int, Failure>) {
        outcome = result
        let callbacks = waiters
        waiters = []
        callbacks.forEach { $0(result) }
    }

    private static func runNode(_ arguments: [String]) -> Int32 {
        // libuv expects the argument strings in one contiguous block of memory.
        let bytes = arguments.flatMap { $0.utf8CString }
        let block = UnsafeMutablePointer<CChar>.allocate(capacity: bytes.count)
        block.initialize(from: bytes, count: bytes.count)
        defer { block.deallocate() }
        var argv: [UnsafeMutablePointer<CChar>?] = []
        var offset = 0
        for argument in arguments {
            argv.append(block + offset)
            offset += argument.utf8CString.count
        }
        argv.append(nil)
        return argv.withUnsafeMutableBufferPointer { node_start(Int32(arguments.count), $0.baseAddress) }
    }
}
