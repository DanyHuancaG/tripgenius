# TRIPGENIUS

Plataforma inteligente para la planificación y gestión de viajes.

- **App publicada:** https://danyhuancag.github.io/tripgenius/
- **Repositorio:** https://github.com/DanyHuancaG/tripgenius

---

## 📁 Estructura del Proyecto

```text
TRIPGENIUS/
│
├── .github/
│   └── workflows/
│       └── pages.yml
│
├── docs/
│   ├── 01_idea_blueprint/
│   │   ├── product_brief.md
│   │   ├── historias_usuario.md
│   │   ├── criterios_aceptacion.md
│   │   ├── user_flow.md
│   │   └── arquitectura.md
│   │
│   ├── 02_context_engineering/
│   │   ├── README.md
│   │   ├── master_prompt.md
│   │   ├── plan_arquitectura.md
│   │   └── roadmap.md
│   │
│   ├── 03_frontend/
│   │   └── plan_hito1.md
│   │
│   ├── 04_backend_supabase/
│   │   └── plan_hito2.md
│   │
│   ├── 05_integracion_ia/
│   │   ├── plan_hito_03.md
│   │   ├── itinerary_schema.json
│   │   └── system_prompt_itinerario.md
│   │
│   └── 06_despliegue/
│       └── plan_hito_04.md
│
├── src/
│   ├── js/
│   └── *.html
│
├── supabase/
│   ├── functions/
│   └── migrations/
│
├── .gitignore
├── CLAUDE.md
└── README.md
```

## 🚀 Descripción de Carpetas

- **`docs/01_idea_blueprint/`**: Documentación inicial, definición de producto, requisitos, historias de usuario, flujos y arquitectura base.
- **`docs/02_context_engineering/`**: Contextos, prompts del sistema, plan de arquitectura y roadmap del proyecto.
- **`docs/03_frontend/`**: Plan y resultados del Hito 1 (Frontend Mock).
- **`docs/04_backend_supabase/`**: Plan y resultados del Hito 2 (Supabase: autenticación, tablas, RLS y persistencia).
- **`docs/05_integracion_ia/`**: Plan del Hito 3 (IA integrada: Claude como principal y Gemini de respaldo), prompt de sistema y esquema JSON del itinerario.
- **`docs/06_despliegue/`**: Plan del Hito 4 (GitHub y publicación en GitHub Pages): revisión de seguridad, despliegue y pruebas en la URL pública.
- **`src/`**: Aplicación web (HTML, Tailwind CSS y JavaScript). Es la única carpeta que se publica en GitHub Pages.
- **`supabase/`**: Migraciones SQL y Edge Functions.
- **`.github/workflows/`**: Flujo de GitHub Actions que publica `src/` en GitHub Pages.
- **`CLAUDE.md`**: Contexto maestro y reglas de trabajo para el agente de IA.
