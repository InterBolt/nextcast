"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const micropack_1 = require("@interbolt/micropack");
class HookCalls extends micropack_1.Micro.Pack {
    constructor(config, name) {
        super();
        this.config = config;
        this.name = name;
    }
    collector = async (ctx) => {
        const { getRoutes, traverse, collect, reportError, getDetailedImports } = ctx;
        const { allowedArgTypes, exportIdentifier, path: fnPath } = this.config;
        const formattedAllowedArgTypes = (Array.isArray(allowedArgTypes) ? allowedArgTypes : [allowedArgTypes]).filter((t) => typeof t === "string");
        getRoutes().forEach(({ files, name: routeName }) => {
            files.forEach((filePath) => {
                const foundHookImport = getDetailedImports(filePath).find((resolvedImport) => resolvedImport.filePath === fnPath &&
                    resolvedImport.exportName === exportIdentifier);
                if (!foundHookImport) {
                    return;
                }
                const { assignee } = foundHookImport;
                if (!assignee) {
                    return;
                }
                traverse(filePath, {
                    CallExpression: (path) => {
                        const isAssignee = path.node.callee.type === "Identifier" &&
                            path.node.callee.name === assignee;
                        if (!isAssignee) {
                            return;
                        }
                        path.node.arguments.forEach((arg) => {
                            const isAllowed = formattedAllowedArgTypes.some((allowedArgType) => arg.type === allowedArgType);
                            if (!isAllowed) {
                                reportError(`arg type "${arg.type}" is not allowed for uses of: ${fnPath}[${exportIdentifier}]`, filePath, path.node);
                            }
                        });
                        const argStrings = path.node.arguments
                            .map((arg) => arg?.value || "")
                            .filter((arg) => typeof arg === "string");
                        collect({
                            args: argStrings,
                            routeName,
                        });
                    },
                });
            });
        });
    };
    reducer = async (ctx) => {
        const { collection } = ctx;
        return collection;
    };
    rewriter = async (ctx) => {
        return;
    };
}
exports.default = HookCalls;
