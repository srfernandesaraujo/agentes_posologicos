# Mídia da Landing Page (Vídeos e Áudio Drop-In)

A landing page usa o registro centralizado em `src/components/landing/mediaConfig.ts` para só requisitar os arquivos já enviados (evitando requisições extras em produção). Sempre que adicionar um novo vídeo nesta pasta (`public/media/`), basta ativar a flag correspondente para `true` em `mediaConfig.ts`.

Enquanto uma flag estiver `false`, a página exibe automaticamente as simulações animadas integradas em código.

## Arquivos suportados (basta salvar com o nome exato)

| Arquivo | Onde aparece | Duração ideal | Peso alvo |
| :--- | :--- | :--- | :--- |
| `hero-ambient.mp4` (e `.webm`) | Fundo sutil do Hero (mudo, loop) | 8–10 s | `< 1.5 MB` |
| `showreel.mp4` (e `.webm`) | Modal **"Ver demonstração"** no Hero | 45–60 s | `< 8 MB` |
| `clip-osce.mp4` (e `.webm`) | Card Bento — **OSCE ao Vivo** | 8–12 s (mudo) | `< 1.8 MB` |
| `clip-dose.mp4` (e `.webm`) | Card Bento — **Calculadora Offline** | 8–12 s (mudo) | `< 1.5 MB` |
| `clip-briefing.mp4` (e `.webm`) | Card Bento — **Briefing por Voz** | 8–12 s (mudo) | `< 1.5 MB` |
| `clip-rooms.mp4` (e `.webm`) | Card Bento — **Salas & Certificado** | 8–12 s (mudo) | `< 1.5 MB` |
| `briefing-demo.mp3` | Player de **Briefing por Voz** na aba *PubMed & Voz* | 15–25 s | `< 400 KB` |

---

## Prompt pronto para gerar `hero-ambient.mp4` (Veo 3 / Runway / Kling)

> *Ultra-clean macro cinematography of translucent glass pharmaceutical spheres and delicate emerald-teal bioluminescent molecular bonds drifting slowly in deep obsidian dark space (`#040A0D`). Subtle cyan and soft violet volumetric light rays refracting through crystal structures, shallow depth of field, serene scientific precision, seamless slow motion loop, no text, no logos, 24fps, 16:9.*

## Roteiro rápido para gravar `showreel.mp4` (45 s — Screen Studio / Remotion)

1. **00:00–00:12 — Clínica & Posologia:** Mostrar envio de prescrição (Varfarina + Amiodarona) → zoom no alerta de interação CYP2C9 + abertura da Calculadora Cockcroft-Gault offline.
2. **00:12–00:24 — OSCE ao Vivo:** Professor clicando em *"Aplicar ao vivo"* → PIN de 6 dígitos na tela → aluno conversando com paciente virtual → rubrica corrigindo automaticamente.
3. **00:24–00:35 — PubMed & Voz:** Busca real no Especialista PubMed → links PMID aparecendo → clique no Briefing por Voz (onda sonora ativa).
4. **00:35–00:45 — Squads:** Escritório de Squads em ação + entrega final consolidada em PDF.

## Compressão recomendada (FFmpeg)

```bash
# Vídeo ambiente mudo (MP4 H.264 otimizado para web)
ffmpeg -i raw.mp4 -an -vf "scale=1280:-2" -c:v libx264 -crf 27 -preset slow -movflags +faststart public/media/hero-ambient.mp4

# Versão WebM (menor peso em Chrome/Firefox)
ffmpeg -i raw.mp4 -an -vf "scale=1280:-2" -c:v libvpx-vp9 -crf 34 -b:v 0 public/media/hero-ambient.webm
```
