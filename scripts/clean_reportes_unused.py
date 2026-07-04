from pathlib import Path

path = Path("web/src/app/(dashboard)/reportes/page.tsx")
text = path.read_text(encoding="utf-8")

text = text.replace('import { BarChart3, ExternalLink } from "lucide-react";\n\n', "")

start = text.find("/**\n * Convierte la URL embebida a URL normal de visualización.")
if start != -1:
    end_marker = "}\n\nexport default function ReportesPage()"
    end = text.find(end_marker, start)
    if end == -1:
        raise SystemExit("No encontré el final de getDataStudioViewUrl.")
    text = text[:start] + "export default function ReportesPage()" + text[end + len(end_marker):]

text = text.replace(
    '  const viewUrl = embedUrl ? getDataStudioViewUrl(embedUrl) : null;\n\n',
    "",
)

path.write_text(text, encoding="utf-8")
print("OK: reportes/page.tsx limpio de imports/variables no usadas.")
