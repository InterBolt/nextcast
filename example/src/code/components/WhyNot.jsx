import useCloudflareData from "../useCloudflareData";
import { useNamedHook as useOtherNamedHookokkok } from "../useNamedHook";

const WhyNot = () => {
  const namedProps = useOtherNamedHookokkok("NESTEDBAFDF");
  const data = useCloudflareData("WHATEVER");
  return (
    <div>
      <h1>Why Not?</h1>
      <p>Why not indeed!</p>
      <p>{JSON.stringify(data)}</p>
      <p>{JSON.stringify(namedProps)}</p>
    </div>
  );
};

export default WhyNot;
