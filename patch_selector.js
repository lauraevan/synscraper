const fs = require("fs");

function patchFile(path, oldText, newText, marker) {
  const input = fs.readFileSync(path, "utf8");
  if (input.includes(marker)) {
    console.log(`${path}: Vidy already present`);
    return;
  }
  if (!input.includes(oldText)) {
    throw new Error(`${path}: selector catalog pattern not found`);
  }
  fs.writeFileSync(path, input.replace(oldText, newText));
  console.log(`${path}: added Vidy to source selector`);
}

patchFile(
  "frontend/src/components/SynapsePlayer.jsx",
  '    { provider: "vidrock", name: "Rock" },\n    { provider: "vixsrc", name: "Vix" },',
  '    { provider: "vidrock", name: "Rock" },\n    { provider: "vidy", name: "Vidy" },\n    { provider: "vixsrc", name: "Vix" },',
  '{ provider: "vidy", name: "Vidy" }'
);

patchFile(
  "public/static/js/main.53686aec.js",
  '{provider:"vidrock",name:"Rock"},{provider:"vixsrc",name:"Vix"}',
  '{provider:"vidrock",name:"Rock"},{provider:"vidy",name:"Vidy"},{provider:"vixsrc",name:"Vix"}',
  '{provider:"vidy",name:"Vidy"}'
);
