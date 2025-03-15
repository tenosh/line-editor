import { Suspense } from "react";
import RoutesContent from "@/app/components/RoutesContent";

export default function Home() {
  return (
    <div className="flex flex-col p-5 mx-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <RoutesContent />
      </Suspense>
    </div>
  );
}
