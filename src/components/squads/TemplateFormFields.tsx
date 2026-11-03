import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormField } from "@/hooks/useSquads";

export function missingRequired(fields: FormField[], values: Record<string, string>): string[] {
  return fields.filter((f) => f.required && !(values[f.key] || "").trim()).map((f) => f.label);
}

/** Formulário gerado a partir da definição do template (campos, opções e obrigatoriedade). */
export function TemplateFormFields({
  fields, values, onChange,
}: { fields: FormField[]; values: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`sq-${f.key}`} className="text-sm text-white/80">
            {f.label}{f.required && <span className="text-[hsl(var(--accent))]"> *</span>}
          </Label>
          {f.type === "text" && (
            <Input
              id={`sq-${f.key}`} value={values[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange(f.key, e.target.value)} className="bg-white/5 border-white/10"
            />
          )}
          {f.type === "textarea" && (
            <Textarea
              id={`sq-${f.key}`} value={values[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange(f.key, e.target.value)} className="min-h-[96px] bg-white/5 border-white/10"
            />
          )}
          {f.type === "select" && (
            <Select value={values[f.key] || ""} onValueChange={(v) => onChange(f.key, v)}>
              <SelectTrigger id={`sq-${f.key}`} className="bg-white/5 border-white/10">
                <SelectValue placeholder="Escolha uma opção" />
              </SelectTrigger>
              <SelectContent>
                {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {f.help && <p className="text-xs text-white/40">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}
