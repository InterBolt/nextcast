import { resolve } from "path";
import HookCalls from "./HookCalls";
import UseContextSelector from "./UseContextSelector";

const macropacks = [
  new HookCalls(
    {
      path: resolve(process.cwd(), "src", "code", "useCloudflareData.ts"),
      exportIdentifier: "default",
      allowedArgTypes: ["StringLiteral"],
    },
    "cloudflare_data"
  ),
  new UseContextSelector("context_selector"),
];

export default macropacks;
