import useCloudflareData from "./useCloudflareData";
import { useNamedHook } from "./useNamedHook";
import WhyNot from "./components/WhyNot";

const OtherComponent = () => {
  const props = useCloudflareData("ff");
  const namedProps = useNamedHook("bbb");
  return (
    <div className="z-10 items-center justify-between w-full max-w-5xl font-mono text-sm lg:flex">
      <pre className="font-mono font-bold">
        {JSON.stringify({ props, namedProps }, null, 2)}
      </pre>
      <WhyNot />
      <div className="fixed bottom-0 left-0 flex items-end justify-center w-full h-48 bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
        <a
          className="flex gap-2 p-8 pointer-events-none place-items-center lg:pointer-events-auto lg:p-0"
          href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          By{" "}
          <img
            src="/vercel.svg"
            alt="Vercel Logo"
            className="dark:invert"
            width={100}
            height={24}
          />
        </a>
      </div>
    </div>
  );
};

export default OtherComponent;
