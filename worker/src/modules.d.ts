// Wrangler's default module rules import *.bin files as ArrayBuffer (Data modules).
declare module "*.bin" {
  const data: ArrayBuffer;
  export default data;
}
