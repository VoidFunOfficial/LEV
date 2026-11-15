#include <signal.h>
#include <sys/prctl.h>
#include <unistd.h>

namespace node { int Start(int argc, char** argv); }

int main(int argc, char** argv) {
    // Android may kill the UI process without calling Activity.onDestroy().
    if (prctl(PR_SET_PDEATHSIG, SIGTERM) != 0 || getppid() == 1) return 1;
    return node::Start(argc, argv);
}
