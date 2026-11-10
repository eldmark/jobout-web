import Encabezado from "@/app/_components/landing/Encabezado";
import Portada from "@/app/_components/landing/Portada";
import ComoFunciona from "@/app/_components/landing/ComoFunciona";
import Recruiters from "@/app/_components/landing/Recruiters";
import VistaPrevia from "@/app/_components/landing/VistaPrevia";
import Niveles from "@/app/_components/landing/Niveles";
import Cierre from "@/app/_components/landing/Cierre";
import Pie from "@/app/_components/landing/Pie";

export default function Home() {
  return (
    <>
      <Encabezado />
      <main>
        <Portada />
        <ComoFunciona />
        <Recruiters />
        <VistaPrevia />
        <Niveles />
        <Cierre />
      </main>
      <Pie />
    </>
  );
}
