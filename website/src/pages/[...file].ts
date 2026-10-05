import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const generated = resolve(process.cwd(), "public/generated");
export async function getStaticPaths() {
  const paths = await readdir(generated, { recursive: true });
  return paths
    .filter((path) => /\.(md|txt|json|gz|tsx)$/.test(path))
    .map((file) => ({ params: { file }, props: { file } }));
}
export async function GET({ props }: { props: { file: string } }) {
  const content = await readFile(resolve(generated, props.file));
  const type = props.file.endsWith(".json")
    ? "application/json"
    : props.file.endsWith(".gz")
      ? "application/gzip"
      : "text/plain; charset=utf-8";
  return new Response(content, { headers: { "Content-Type": type } });
}
