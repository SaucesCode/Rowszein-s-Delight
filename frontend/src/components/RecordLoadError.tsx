import { isAxiosError } from "axios";

export default function RecordLoadError({ name, invalidId, error, retry, back }: {
  name: string;
  invalidId: boolean;
  error: unknown;
  retry: () => void;
  back: () => void;
}) {
  const missing = isAxiosError(error) && error.response?.status === 404;
  const message = invalidId || missing
    ? `We couldn't find this ${name}. It may have been deleted.`
    : `Couldn't load this ${name}. Check the internet connection, then try again.`;

  return (
    <div role="alert" className="card-surface p-6">
      <p>{message}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {!invalidId && !missing && <button type="button" className="btn-primary" onClick={retry}>Try again</button>}
        <button type="button" className="btn-ghost" onClick={back}>Back to the list</button>
      </div>
    </div>
  );
}
