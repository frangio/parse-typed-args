export default {
  files: ["**/*.test.ts"],
  require: ["./babel-register"],
  babel: {
    extensions: [
      "ts",
    ],
  },
  verbose: true,
};
