import { HomeView } from "@/components/home/HomeView";
import { getHomeSections } from "@/data/home";

// HOME — guest view for now; the login task adds the viewer's state.
export default async function HomePage() {
  const data = await getHomeSections();
  return <HomeView data={data} />;
}
