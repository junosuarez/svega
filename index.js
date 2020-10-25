#! /usr/bin/env node
const vegaLite = require("vega-lite");
const vega = require("vega");
const { resolve } = require("path");
const { readFileSync } = require("fs");
const parseCsv = require("papaparse").parse;
const ndjson = require("ndjson");
const { Readable } = require("stream");

let primaryDataSourceName = null;

async function toList(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

async function read(stream) {
  return Buffer.concat(await toList(stream)).toString("utf8");
}

function usageExit(hint) {
  if (hint) {
    console.error(hint);
    console.error();
  }
  console.error(`svega [opts] <spec.vl.json> < data.json`);
  console.error();
  console.error(`   stdin must be data, stdout will be svg or empty`);
  console.error();
  console.error(`   OPTIONS:`);
  console.error(`     --format=[auto],json,ndjson,csv,textRows`);

  process.exit(1);
}

function crash(msg) {
  console.error("SVEGA:", msg);
  process.exit(1);
}

function loadSpec(specPath) {
  if (!/\.v[gl]\.json$/.test(specPath)) {
    usageExit("last argument must be a .vl.json or .vg.json file");
  }
  return JSON.parse(readFileSync(specPath));
}

const parsers = {
  async auto(raw) {
    // naïvely try a every way to parse this (todo: heuristics)
    for (let parser in parsers) {
      if (parser === "auto") continue;
      try {
        return await parsers[parser](raw);
      } catch (e) {}
    }
    crash("could not parse input");
  },
  async json(raw) {
    return JSON.parse(raw);
  },
  async ndjson(raw) {
    const stream = Readable.from(raw).pipe(ndjson.parse());
    return await toList(stream);
  },
  async csv(raw) {
    return parseCsv(raw, { header: true }).data;
  },
  async textrows(raw) {
    return raw.split("\n");
  },
};

async function loadData(format) {
  // load data from stdin
  if (process.stdin.isTTY) {
    usageExit("must pass in data to stdin");
  }
  const rawData = (await read(process.stdin)).trim();
  return parsers[format](rawData);
}

async function toSvg(vlSpec, data) {
  // compile vega-lite to full vega spec, create view, and add data
  const spec =
    vlSpec.$schema === "https://vega.github.io/schema/vega-lite/v4.json"
      ? vegaLite.compile(vlSpec).spec
      : vlSpec;
  const view = new vega.View(vega.parse(spec));

  view.insert(primaryDataSourceName, data);

  // render to svg
  return await view.toSVG();
}

async function main() {
  // parse args
  const args = process.argv.slice(2);
  if (args.some((a) => a === "--help" || a === "-h")) {
    usageExit();
  }

  // find the graph spec (it should end in .json)
  const specArg = args.find((a) => a.endsWith(".json"));
  if (!specArg) {
    usageExit("can't find spec");
  }
  const specPath = resolve(process.cwd(), specArg);

  const format =
    process.argv
      .filter((a) => a.startsWith("--format="))
      .map((a) => String(a.split("=")[1]).toLowerCase())
      .filter((v) => ["auto", "csv", "json", "ndjson"])[0] || "auto";

  const [vlSpec, data] = await Promise.all([
    loadSpec(specPath),
    loadData(format),
  ]);

  if (
    vlSpec.$schema !== "https://vega.github.io/schema/vega-lite/v4.json" &&
    vlSpec.$schema !== "https://vega.github.io/schema/vega/v5.json"
  ) {
    usageExit("must pass a vega or vega-lite spec");
  }
  // find first data source name
  let ds = vlSpec.data;
  if (Array.isArray(vlSpec.data)) {
    ds = vlSpec.data[0];
  }
  delete ds.url;
  if (ds.name) {
    primaryDataSourceName = ds.name;
  } else {
    primaryDataSourceName = "svega";
    ds.name = "svega";
  }

  // render svg to stdout
  console.log(await toSvg(vlSpec, data));
}

main().catch((e) => crash(e));
