const yaml = require("js-yaml");
const { DateTime } = require("luxon");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const htmlmin = require("html-minifier");

module.exports = function (eleventyConfig) {
  // put near the top of your config
  eleventyConfig.addWatchTarget("src/admin"); // hot-reload when config changes

  // publish the entire CMS app (index.html, config.yml, any custom widgets)
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  // Disable automatic use of your .gitignore
  eleventyConfig.setUseGitIgnore(false);

  // Merge data instead of overriding
  eleventyConfig.setDataDeepMerge(true);

  // human readable date
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  // Syntax Highlighting for Code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // To Support .yaml Extension in _data
  // You may remove this if you can use JSON
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Copy Static Files to /_Site
  eleventyConfig.addPassthroughCopy({
    "./node_modules/alpinejs/dist/cdn.min.js": "./static/js/alpine.js",
    "./node_modules/prismjs/themes/prism-tomorrow.css":
      "./static/css/prism-tomorrow.css",
  });
  eleventyConfig.addCollection("tires", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/tires/*.md")
      .sort((a, b) =>
        (a.data.brand + a.data.model).localeCompare(b.data.brand + b.data.model)
      );
  });
  eleventyConfig.addPassthroughCopy({ "src/scripts": "scripts" });
  // // Copy Image Folder to /_site
  // eleventyConfig.addPassthroughCopy("./src/static/img");
  // eleventyConfig.addPassthroughCopy("./src/static/css");
  // // Copy favicon to route of /_site
  eleventyConfig.addPassthroughCopy("./src/favicon.ico");
  eleventyConfig.addPassthroughCopy({ "src/static": "static" });
  // eleventyConfig.addPassthroughCopy({
  //   "./src/admin/init.js": "./admin/init.js",
  // });

  // Let Eleventy transform HTML files as nunjucks
  // So that we can use .html instead of .njk
  return {
    dir: {
      input: "src",
    },
    htmlTemplateEngine: "njk",
  };
};
