// A missing file is the one read failure the translation scripts recover from. Everything else —
// malformed JSON, a permissions error, a directory where a file was expected — has to surface,
// because the recovery path is "assume nothing has been translated yet", and that spends a full
// catalogue of model quota and then overwrites whatever was actually there
export default function isFileNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}
