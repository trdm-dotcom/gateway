const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const config = require("../../config");

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      config.google,
      async (accessToken, refreshToken, profile, done) => {
        console.log(accessToken, refreshToken, profile);
        done(null, profile);
      }
    )
  );

  passport.serializeUser((user, done) => {
   
  });

  passport.deserializeUser((id, done) => {
    
  });
};
