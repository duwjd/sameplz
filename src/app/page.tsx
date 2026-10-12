import { HomeView } from "@/components/home/HomeView";

// HOME — 비회원 기준. 로그인(W1 스파이크) 뒤 getClaims()로 user를 넘긴다.
export default function HomePage() {
  return <HomeView />;
}
