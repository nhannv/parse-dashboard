'use strict';
const express = require('express');
const path = require('path');
const packageJson = require('package-json');
const csrf = require('csurf');
const Authentication = require('./Authentication.js');
const fs = require('fs');
const settings = require('@back4app/back4app-settings');

const currentVersionFeatures = require('../package.json').parseDashboardFeatures;

var newFeaturesInLatestVersion = [];
packageJson('parse-dashboard', 'latest').then(latestPackage => {
  if (latestPackage.parseDashboardFeatures instanceof Array) {
    newFeaturesInLatestVersion = latestPackage.parseDashboardFeatures.filter(feature => {
      return currentVersionFeatures.indexOf(feature) === -1;
    });
  }
});

function getMount(mountPath) {
  mountPath = mountPath || '';
  if (!mountPath.endsWith('/')) {
    mountPath += '/';
  }
  return mountPath;
}

function checkIfIconsExistForApps(apps, iconsFolder) {
  for (var i in apps) {
    var currentApp = apps[i];
    var iconName = currentApp.iconName;
    var path = iconsFolder + '/' + iconName;

    fs.stat(path, function(err) {
      if (err) {
          if ('ENOENT' == err.code) {// file does not exist
              console.warn('Icon with file name: ' + iconName +' couldn\'t be found in icons folder!');
          } else {
            console.log(
              'An error occurd while checking for icons, please check permission!');
          }
      } else {
          //every thing was ok so for example you can read it and send it to client
      }
  } );
  }
}

module.exports = function(config, options) {
  options = options || {};
  var app = express();
  // Serve public files.
  app.use(express.static(path.join(__dirname,'public')));

  // Allow setting via middleware
  if (config.trustProxy && app.disabled('trust proxy')) {
    app.enable('trust proxy');
  }

  // wait for app to mount in order to get mountpath
  app.on('mount', function() {
    const mountPath = getMount(app.mountpath);
    let dashboardUrl = '';
    let loginUrl = '';

    // Reads files from public/bundles folder, looking for dashboard.<hash>.js and login.<hash>.js
    fs.readdir(path.join(__dirname, 'public', 'bundles'), function(err, items) {
      dashboardUrl = items && items.filter(file => file.indexOf('dashboard.') === 0)[0] || 'dashboard.bundle.js';
      loginUrl = items && items.filter(file => file.indexOf('login.') === 0)[0] || 'login.bundle.js';
    });

    const users = config.users;
    const useEncryptedPasswords = !!config.useEncryptedPasswords;
    const authInstance = new Authentication(users, useEncryptedPasswords, mountPath);
    authInstance.initialize(app, { cookieSessionSecret: options.cookieSessionSecret });

    // CSRF error handler
    app.use(function (err, req, res, next) {
      if (err.code !== 'EBADCSRFTOKEN') return next(err)

      // handle CSRF token errors here
      res.status(403)
      res.send('form tampered with')
    });

    // Serve the configuration.
    app.get('/parse-dashboard-config.json', function(req, res) {
      let apps = config.apps.map((app) => Object.assign({ masterKey: "******" }, app)); // make a copy
      let response = {
        apps: apps,
        newFeaturesInLatestVersion: newFeaturesInLatestVersion,
      };

      //Based on advice from Doug Wilson here:
      //https://github.com/expressjs/express/issues/2518
      const requestIsLocal =
        req.connection.remoteAddress === '127.0.0.1' ||
        req.connection.remoteAddress === '::ffff:127.0.0.1' ||
        req.connection.remoteAddress === '::1';
      if (!options.dev && !requestIsLocal) {
        if (!req.secure && !options.allowInsecureHTTP) {
          //Disallow HTTP requests except on localhost, to prevent the master key from being transmitted in cleartext
          return res.send({ success: false, error: 'Parse Dashboard can only be remotely accessed via HTTPS' });
        }

        if (!users) {
          //Accessing the dashboard over the internet can only be done with username and password
          return res.send({ success: false, error: 'Configure a user to access Parse Dashboard remotely' });
        }
      }
      const authentication = req.user;

      const successfulAuth = authentication && authentication.isAuthenticated;
      const appsUserHasAccess = authentication && authentication.appsUserHasAccessTo;
      const isReadOnly = authentication && authentication.isReadOnly;
      // User is full read-only, replace the masterKey by the read-only one
      if (isReadOnly) {
        response.apps = response.apps.map((app) => {
          app.masterKey = app.readOnlyMasterKey;
          if (!app.masterKey) {
            throw new Error('You need to provide a readOnlyMasterKey to use read-only features.');
          }
          return app;
        });
      }

      if (successfulAuth) {
        if (appsUserHasAccess) {
          // Restric access to apps defined in user dictionary
          // If they didn't supply any app id, user will access all apps
          response.apps = response.apps.filter(function (app) {
            return appsUserHasAccess.find(appUserHasAccess => {
              const isSame = app.appId === appUserHasAccess.appId;
              if (isSame && appUserHasAccess.readOnly) {
                app.masterKey = app.readOnlyMasterKey;
              }
              return isSame;
            })
          });
        }
        // They provided correct auth
        return res.json(response);
      }

      if (users) {
        //They provided incorrect auth
        return res.sendStatus(401);
      }

      //They didn't provide auth, and have configured the dashboard to not need auth
      //(ie. didn't supply usernames and passwords)
      if (requestIsLocal || options.dev) {
        //Allow no-auth access on localhost only, if they have configured the dashboard to not need auth
        return res.json(response);
      }
      //We shouldn't get here. Fail closed.
      res.send({ success: false, error: 'Something went wrong.' });
    });

    // Serve the app icons. Uses the optional `iconsFolder` parameter as
    // directory name, that was setup in the config file.
    // We are explicitly not using `__dirpath` here because one may be
    // running parse-dashboard from globally installed npm.
    if (config.iconsFolder) {
      try {
        var stat = fs.statSync(config.iconsFolder);
        if (stat.isDirectory()) {
          app.use('/appicons', express.static(config.iconsFolder));
          //Check also if the icons really exist
          checkIfIconsExistForApps(config.apps, config.iconsFolder);
        }
      } catch (e) {
        // Directory doesn't exist or something.
        console.warn('Iconsfolder at path: ' + config.iconsFolder +
          ' not found!');
      }
    }

    app.get('/login', csrf(), function(req, res) {
      if (!users || (req.user && req.user.isAuthenticated)) {
        return res.redirect(`${mountPath}apps`);
      }

      let errors = req.flash('error');
      if (errors && errors.length) {
        errors = `<div id="login_errors" style="display: none;">
          ${errors.join(' ')}
        </div>`
      }
      res.send(`<!DOCTYPE html>
        <head>
          <link rel="shortcut icon" type="image/x-icon" href="${mountPath}favicon.ico" />
          <base href="${mountPath}"/>
          <script>
            PARSE_DASHBOARD_PATH = "${mountPath}";
          </script>
        </head>
        <html>
          <title>Parse Dashboard</title>
          <body>
            <div id="login_mount"></div>
            ${errors}
            <script id="csrf" type="application/json">"${req.csrfToken()}"</script>
            <script src="${mountPath}bundles/${loginUrl}"></script>
            <script src="${settings.BACK4APP_NAVIGATION_PATH}/back4app-navigation.bundle.js"></script>
          </body>
        </html>
      `);
    });

    // For every other request, go to index.html. Let client-side handle the rest.
    app.get('/*', function(req, res) {
      if (users && (!req.user || !req.user.isAuthenticated)) {
        return res.redirect(`${mountPath}login`);
      }
      if (users && req.user && req.user.matchingUsername ) {
        res.append('username', req.user.matchingUsername);
      }
      res.send(`<!DOCTYPE html>
        <head>
          <link rel="shortcut icon" type="image/x-icon" href="${mountPath}favicon.ico" />
          <base href="${mountPath}"/>
          <script>
            PARSE_DASHBOARD_PATH = "${mountPath}";
          </script>
        </head>
        <html>
          <title>Parse Dashboard</title>
          <body>
            <div id="browser_mount"></div>
            <script src="${mountPath}bundles/${dashboardUrl}"></script>
            <script src="${settings.BACK4APP_NAVIGATION_PATH}/back4app-navigation.bundle.js"></script>
            <!--Start of Zopim Live Chat Script-->
            <script async>/*<![CDATA[*/top.location.href && (window.zEmbed || function (e, t) { var n, o, d, i, s, a = [], r = document.createElement("iframe"); window.zEmbed = function () { a.push(arguments) }, window.zE = window.zE || window.zEmbed, r.src = "javascript:false", r.title = "", r.role = "presentation", (r.frameElement || r).style.cssText = "display: none", d = document.getElementsByTagName("script"), d = d[d.length - 1], d.parentNode.insertBefore(r, d), i = r.contentWindow, s = i.document; try { o = s } catch (e) { n = document.domain, r.src = 'javascript:var d=document.open();d.domain="' + n + '";void(0);', o = s } o.open()._l = function () { var e = this.createElement("script"); n && (this.domain = n), e.id = "js-iframe-async", e.src = "https://assets.zendesk.com/embeddable_framework/main.js", this.t = +new Date, this.zendeskHost = "back4app.zendesk.com", this.zEQueue = a, this.body.appendChild(e) }, o.write('<body onload="document._l();">'), o.close() }());/*]]>*/</script>
            <!--End of Zopim Live Chat Script-->
            <script src="https://survey.solucx.com.br/widget.js"></script>
          </body>
        </html>
      `);
    });
  });

  return app;
}
