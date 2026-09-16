import { ProjectScreen } from "@/components/projects/ProjectScreen";

/**
 * The page itself stays a thin Server Component: it reads the id from the URL and hands it
 * to the client screen, which is what the tests render directly.
 */
export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;

  return <ProjectScreen projectId={id} />;
}
