import { NextJSRewriter, NextJSRewriterContext } from "../../types";
import { Config } from ".";

const rewriter: NextJSRewriter<NextJSRewriterContext<Config>> = async (ctx) => {
  return;
};

export default rewriter;
