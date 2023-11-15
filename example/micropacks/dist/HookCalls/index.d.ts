import { Micro } from "@interbolt/micropack";
type Config = {
    path: string;
    exportIdentifier?: string;
    allowedArgTypes?: Array<string>;
};
declare class HookCalls implements Micro.Definition<Config> {
    config: Config;
    name: string;
    constructor(config: Config, name: string);
    collector: Micro.Collector<Config>;
    reducer: Micro.Reducer<Config>;
    rewriter: Micro.Rewriter<Config>;
}
export default HookCalls;
