<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- All backend calls go through `src/lib/api.ts` (base URL only in `src/lib/config.ts`) against the external REST API; never use Lovable Cloud/Supabase, because the backend is a separate service the user owns.
- Use semantic Tailwind tokens from `src/styles.css` for all visual colors and typography, so light and dark themes remain coherent.
