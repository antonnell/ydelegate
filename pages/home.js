import Assets from "./assets";
import { useRouter } from "next/router";

function Home({ changeTheme, ...props }) {
  const router = useRouter();
  const activePath = router.asPath;
  if (activePath.includes("/assets")) {
    return <Assets props={props} changeTheme={changeTheme} />;
  } else {
    return <Assets props={props} changeTheme={changeTheme} />;
  }
}

export default Home;
