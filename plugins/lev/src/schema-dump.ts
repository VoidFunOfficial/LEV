// Build-time only: build.mjs bundles this for Node and reads the schema the parser validates against.
import "@/openui/devtools";
import { library } from "@/openui/library";

export const schema = library.toJSONSchema();
