import { NextJSReducer } from "../../types";
import { Config } from "./index";

const reducer: NextJSReducer<Config> = async (ctx) => {
  const {
    macroConfig: {
      exportIdentifier = "default",
      path: fnPath,
      allowedArgTypes = null,
    },
    collection,
  } = ctx;

  return collection;
};

export default reducer;
