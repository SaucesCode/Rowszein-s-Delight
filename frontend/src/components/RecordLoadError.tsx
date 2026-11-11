import { isAxiosError } from "axios";

export default function RecordLoadError({ name, invalidId, error, retry, back }: {
  name: string;
  invalidId: boolean;
  error: unknown;
  retry: () => void;
  back: () => void;
}) {
  const missing = isAxiosError(error) && error.response?.status === 404;
  return <div role="alert" className="card-surface p-6">
    <p>{invalidId ? `Invalid ${name} ID.` : missing ? `This ${name} was not found.` : `Unable to load this ${name}. Your access or connection may have changed.`}</p>
    <div className="flex gap-3 mt-4">
      {!invalidId && !missing && <button type="button" className="btn-primary" onClick={retry}>Retry loading</button>}
      <button type="button" className="btn-ghost" onClick={back}>Return to list</button>
    </div>
  </div>;
}
