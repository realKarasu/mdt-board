/// <reference types="vite/client" />

declare module "*.mdt?raw" {
  const content: string;
  export default content;
}
