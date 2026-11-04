import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { policyDocs } from "@/lib/privacyPolicy";
import { useI18n } from "@/lib/i18n";

export default function Privacy() {
  const [, setLocation] = useLocation();
  const { language, t } = useI18n();
  const doc = policyDocs[language];

  return (
    <main className="safe-scroll h-full overflow-y-auto bg-background px-5 py-8 text-foreground">
      <section className="mx-auto max-w-2xl rounded-2xl border border-primary/20 bg-black/40 p-6 shadow-[0_0_30px_rgba(0,243,255,0.08)] md:p-10">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mb-8 inline-flex min-h-11 items-center gap-2 text-primary transition-colors hover:text-white"
        >
          <ArrowLeft size={20} /> {t("back")}
        </button>

        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary md:text-4xl">{doc.title}</h1>
        </div>

        <div className="space-y-5 font-exo leading-relaxed text-muted-foreground">
          <p className="text-sm">{doc.updated}</p>
          <p>{doc.intro}</p>
          {doc.sections.map(section => (
            <div key={section.heading}>
              <h2 className="mb-2 text-lg font-bold text-foreground">{section.heading}</h2>
              <p>{section.body}</p>
            </div>
          ))}
          <div>
            <h2 className="mb-2 text-lg font-bold text-foreground">{t("contact")}</h2>
            <p>
              <a className="text-primary underline" href="mailto:bynrnworld@gmail.com">bynrnworld@gmail.com</a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
