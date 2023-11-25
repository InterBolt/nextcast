async function loaderRewrite(code: string) {
  const callback = this.async();
  const options = this.getOptions();

  if (!options.source) {
    throw new Error(
      `rewrite-loader: source option is required in rewrite loader`
    );
  }

  callback(null, options.source || code);
}

export default loaderRewrite;
