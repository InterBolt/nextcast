const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="inner-layout">
      <div className="inner-layout__header">
        <div className="inner-layout__header__logo"></div>
        <div className="inner-layout__header__title">
          <h1>React App</h1>
        </div>
      </div>
      <div className="inner-layout__content">{children}</div>
    </div>
  );
};

export default Layout;
