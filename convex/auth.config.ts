export default {
  providers: [
    {
      domain: process.env.AUTH_DOMAIN || "https://accounts.google.com",
      applicationID: "convex",
    },
  ],
};
