Install dev dependencies to pull in [vega-datasets](https://github.com/vega/vega-datasets).

Display from csv data:

```sh
cat node_modules/vega-datasets/data/seattle-weather.csv | ./index.js example/wx.vl.json | isvg
```

Display from ndjson data:

```sh
cat node_modules/vega-datasets/data/movies.json \
| jq -c .[] \
| ./index.js example.movies.vl.json --format=ndjson \
| isvg
```

using [jq](https://stedolan.github.io/jq/) to turn the example json to ndjson

Display from json data:

```sh
cat node_modules/vega-datasets/data/movies.json \
| ./index.js example/movies.vl.json \
| isvg
```

See note about `isvg` in main readme.
