module.exports = {
    output: "standalone",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Add this experimental block
    experimental: {
        serverActions: {
            bodySizeLimit: "10mb", // Or whatever size you need. '10mb' is a good starting point for PDFs.
        },
    },
};

module.exports = nextConfig;
