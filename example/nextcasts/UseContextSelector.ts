import { TNextcast } from "nextcast";

class UseContextSelectorLibraryInstead implements TNextcast.CustomPlugin {
  declare config: any;
  declare name: string;

  constructor(name: string) {
    this.config = {};
    this.name = name;
  }

  public collector: TNextcast.Collector = async (ctx) => {
    const {
      getSourceFiles,
      getRoutes,
      babelTraverse,
      collect,
      reportError,
      getDetailedImports,
    } = ctx;
  };

  public reducer: TNextcast.Reducer = async (ctx) => {
    const { collection } = ctx;

    return collection;
  };

  public rewriter: TNextcast.Rewriter = async (ctx) => {
    const {
      getSourceFiles,
      getRoutes,
      jscodeshift,
      collect,
      reportError,
      getDetailedImports,
    } = ctx;

    // Remove all uses of React.useContext

    getSourceFiles().forEach((sourceFile) => {
      jscodeshift(sourceFile);
    });

    return;
  };
}

export default UseContextSelectorLibraryInstead;