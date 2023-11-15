import { resolve } from "path";
import HookCalls from "./HookCalls";

const macropacks = [
  new HookCalls(
    {
      path: resolve(process.cwd(), "src", "code", "useCloudflareData.ts"),
      exportIdentifier: "default",
      allowedArgTypes: ["StringLiteral"],
    },
    "useCloudflareData"
  ),
];

export default macropacks;
