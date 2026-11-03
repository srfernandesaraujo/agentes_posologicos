import { useEffect, useState } from "react";
import { Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSquadActions, useSquadSchedule, type Squad, type SquadTemplateInfo } from "@/hooks/useSquads";
import { TemplateFormFields, missingRequired } from "./TemplateFormFields";
import { CostCapField, fmtUsd } from "./CostCapField";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Agendamento de squads contínuos: o squad roda sozinho e deixa a entrega aguardando a sua decisão. */
export function SchedulePanel({ squad, template }: { squad: Squad; template: SquadTemplateInfo }) {
  const { data: schedule, isLoading } = useSquadSchedule(squad.id);
  const { setSchedule } = useSquadActions();

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [hour, setHour] = useState(7);
  const [dow, setDow] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [cap, setCap] = useState(template.defaultCapUsd);
  const [monthly, setMonthly] = useState(20);

  useEffect(() => {
    if (!schedule) return;
    setEnabled(schedule.enabled);
    setFrequency(schedule.frequency);
    setHour(schedule.run_hour);
    setDow(schedule.run_day_of_week ?? 1);
    setValues(schedule.form_data || {});
    setCap(Number(schedule.cost_cap_usd));
    setMonthly(Number(schedule.monthly_cap_usd));
  }, [schedule]);

  const missing = missingRequired(template.formFields, values);

  const save = async () => {
    if (missing.length) { toast.error(`Preencha: ${missing.join(", ")}`); return; }
    try {
      await setSchedule.mutateAsync({
        squadId: squad.id, enabled, frequency, runHour: hour, runDayOfWeek: frequency === "weekly" ? dow : null,
        formData: values, costCapUsd: cap, monthlyCapUsd: monthly,
      });
      toast.success("Agendamento salvo");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível salvar o agendamento");
    }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-white/40" />;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/60">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          O squad roda sozinho no horário escolhido (horário de Brasília) usando os dados abaixo, e leva o resultado da execução
          anterior como contexto. A entrega final fica aguardando a sua decisão: nada é aprovado nem enviado sem você.
          {schedule?.last_run_at && <> Última execução: {new Date(schedule.last_run_at).toLocaleString("pt-BR")}.</>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="sch-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="sch-enabled" className="text-sm text-white/80">Agendamento ligado</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-white/80">Frequência</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as "daily" | "weekly")}>
            <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Toda semana</SelectItem>
              <SelectItem value="daily">Todo dia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {frequency === "weekly" && (
          <div className="space-y-1.5">
            <Label className="text-sm text-white/80">Dia</Label>
            <Select value={String(dow)} onValueChange={(v) => setDow(Number(v))}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sch-hour" className="text-sm text-white/80">Hora (0 a 23)</Label>
          <Input id="sch-hour" type="number" min={0} max={23} value={hour}
            onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} className="bg-white/5 border-white/10" />
        </div>
      </div>

      <TemplateFormFields fields={template.formFields} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

      <CostCapField value={cap} onChange={setCap} max={template.maxCapUsd} estimate={template.estimatedCostUsd} label="Teto de custo por execução" />

      <div className="space-y-1.5">
        <Label htmlFor="sch-monthly" className="text-sm text-white/80">Teto por mês (soma das execuções)</Label>
        <Input id="sch-monthly" type="number" min={1} max={200} value={monthly}
          onChange={(e) => setMonthly(Math.min(200, Math.max(1, Number(e.target.value) || 1)))} className="max-w-[160px] bg-white/5 border-white/10" />
        <p className="text-xs text-white/40">Ao atingir {fmtUsd(monthly)} no mês, as execuções agendadas são puladas até o mês seguinte.</p>
      </div>

      <Button onClick={save} disabled={setSchedule.isPending} className="gap-2">
        {setSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar agendamento
      </Button>
    </div>
  );
}
