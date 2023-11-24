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
      babelTraversal,
      collect,
      reportError,
      getImports,
    } = ctx;
  };

  public builder: TNextcast.Builder = async (ctx) => {
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
      getImports,
    } = ctx;

    // Remove all uses of React.useContext

    getSourceFiles().forEach((sourceFile) => {
      jscodeshift(sourceFile);
    });

    return;
  };
}

export default UseContextSelectorLibraryInstead;
