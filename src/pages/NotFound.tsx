import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(220,25%,5%)]">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-white">404</h1>
        <p className="mb-4 text-xl text-white/50">{t("notFound.desc")}</p>
        <a href="/" className="text-[hsl(174,62%,47%)] underline hover:text-[hsl(174,62%,50%)]">
          {t("notFound.home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
