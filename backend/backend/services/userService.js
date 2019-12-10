module.exports = {

    findBy: async function (query, skip, limit) {
        if (!skip) skip = 0;

        if (!limit) limit = 0;

        if (typeof (skip) === 'string') skip = parseInt(skip);

        if (typeof (limit) === 'string') limit = parseInt(limit);

        if (!query) query = {};

        if (!query.deleted) query.deleted = false;
        try {
            var users = await UserModel.find(query)
                .sort([['createdAt', -1]])
                .limit(limit)
                .skip(skip);
        } catch (error) {
            ErrorService.log('UserModel.find', error);
            throw error;
        }
        return users;
    },

    create: async function (data) {
        var userModel = new UserModel();
        userModel.name = data.name || null;
        userModel.email = data.email || null;
        userModel.password = data.password || null;
        userModel.companyName = data.companyName || null;
        userModel.companyRole = data.companyRole || null;
        userModel.companySize = data.companySize || null;
        userModel.referral = data.referral || null;
        userModel.companyPhoneNumber = data.companyPhoneNumber || null;
        userModel.onCallAlert = data.onCallAlert || null;
        userModel.profilePic = data.profilePic || null;
        userModel.jwtRefreshToken = data.jwtRefreshToken || null;
        userModel.stripeCustomerId = data.stripeCustomerId || null;
        userModel.resetPasswordToken = data.resetPasswordToken || null;
        userModel.resetPasswordExpires = data.resetPasswordExpires || null;
        userModel.createdAt = data.createdAt || Date.now();
        userModel.timezone = data.timezone || null;
        userModel.lastActive = data.lastActive || Date.now();
        userModel.coupon = data.coupon || null;
        userModel.adminNotes = data.adminNotes || null;
        userModel.tempEmail = data.tempEmail || null;
        try {
            var user = await userModel.save();
        } catch (error) {
            ErrorService.log('userModel.save', error);
            throw error;
        }
        return user;
    },

    countBy: async function (query) {
        if (!query) {
            query = {};
        }

        if (!query.deleted) query.deleted = false;
        try {
            var count = await UserModel.count(query);
        } catch (error) {
            ErrorService.log('UserModel.count', error);
            throw error;
        }
        return count;
    },

    deleteBy: async function (query, userId) {

        if (!query) {
            query = {};
        }

        query.deleted = false;

        try {
            var user = await UserModel.findOneAndUpdate(query, {
                $set: {
                    deleted: true,
                    deletedById: userId,
                    deletedAt: Date.now()
                }
            }, {
                new: true
            });
        } catch (error) {
            ErrorService.log('UserModel.updateMany', error);
            throw error;
        }
        return user;
    },

    findOneBy: async function (query) {
        if (!query) {
            query = {};
        }
        if (!query.deleted) query.deleted = false;
        try {
            var user = await UserModel.findOne(query)
                .sort([['createdAt', -1]]);
        } catch (error) {
            ErrorService.log('UserModel.findOne', error);
            throw error;
        }
        return user;
    },

    updateBy: async function (query, data) {
        if (!query) {
            query = {};
        }

        if (!query.deleted) query.deleted = false;

        if(data.role) delete data.role;
        if(data.airtableId) delete data.airtableId;
        if(data.tutorial) delete data.tutorial;
        if(data.paymentFailedDate) delete data.paymentFailedDate;
        if(data.alertPhoneNumber) delete data.alertPhoneNumber;
        if (typeof data.isBlocked !== 'boolean') {
            delete data.isBlocked;
        }

        try {
            var updatedUser = await UserModel.findOneAndUpdate(query, {
                $set: data
            }, {
                new: true
            });
        } catch (error) {
            ErrorService.log('UserModel.findOneAndUpdate', error);
            throw error;
        }
        return updatedUser;
    },

    closeTutorialBy: async function (query, type, data) {
        if (!query) query = {};
        if (!data) data = {};

        type = type.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
        data[type] = { show: false };

        try {
            var tutorial = await UserModel.findOneAndUpdate(query, { $set: { tutorial: data } }, { new: true });
        } catch (error) {
            ErrorService.log('UserModel.findOneAndUpdate', error);
            throw error;
        }

        return tutorial || null;
    },

    sendToken: async function (user, email) {
        const _this = this;
        var verificationTokenModel = new VerificationTokenModel({
            userId: user._id,
            token: crypto.randomBytes(16).toString('hex')
        });
        try {
            var verificationToken = await verificationTokenModel.save();
        } catch (error) {
            ErrorService.log('UserVerificationService.createVerificationToken', error);
            throw error;
        }
        if (verificationToken) {
            var verificationTokenURL = `${BACKEND_HOST}/user/confirmation/${verificationToken.token}`;
            MailService.sendVerifyEmail(verificationTokenURL, user.name, email);
            if (email !== user.email) {
                _this.updateBy({ _id: user._id }, { tempEmail: email });
            }
        }
        return verificationToken.token;
    },
    //Description: signup function for new user.
    //Params:
    //Param 1: data: User details.
    //Returns: promise.
    signup: async function (data) {
        var _this = this;
        var email = data.email;
        var stripePlanId = data.planId;
        var paymentIntent = data.paymentIntent;

        if (util.isEmailValid(email)) {
            try {
                var user = await _this.findOneBy({ email: email });

                if (user) {
                    let error = new Error('User already exists.');
                    error.code = 400;
                    ErrorService.log('UserService.signup', error);
                    throw error;
                } else {
                    // Check here is the payment intent is successfully paid. If yes then create the customer else not.
                    var processedPaymentIntent = await PaymentService.checkPaymentIntent(paymentIntent);
                    if (processedPaymentIntent.status !== 'succeeded') {
                        let error = new Error('Unsuccessful attempt to charge card');
                        error.code = 400;
                        ErrorService.log('PaymentService.checkPaymentIntent', error);
                        throw error;
                    }
                    var customerId = processedPaymentIntent.customer;

                    var hash = await bcrypt.hash(data.password, constants.saltRounds);

                    data.password = hash;
                    // creating jwt refresh token
                    data.jwtRefreshToken = randToken.uid(256);
                    //save a user only when payment method is charged and then next steps
                    user = await _this.create(data);

                    let createdAt = new Date(user.createdAt).toISOString().split('T', 1);
                    var record = await AirtableService.logUser({
                        name: data.name,
                        email: data.email,
                        phone: data.companyPhoneNumber,
                        company: data.companyName,
                        jobRole: data.companyRole,
                        createdAt
                    });

                    await _this.sendToken(user, user.email);

                    //update customer Id
                    user = await _this.updateBy({ _id: user._id }, { stripeCustomerId: customerId });
                    var subscription = await PaymentService.subscribePlan(stripePlanId, customerId, data.coupon);

                    var projectName = 'Unnamed Project';
                    var projectData = {
                        name: projectName,
                        userId: user._id,
                        stripePlanId: stripePlanId,
                        stripeSubscriptionId: subscription.stripeSubscriptionId
                    };
                    await ProjectService.create(projectData);

                    user.airtableId = record.id || null;

                    return user;
                }
            } catch (error) {
                if (error.message.indexOf('for model "ProjectModel"') !== -1) {
                    ErrorService.log('ProjectService.create', error);
                } else if (error.message.indexOf('for model "Subscriptions"') !== -1) {
                    ErrorService.log('PaymentService.subscribePlan', error);
                } else if (error.message.indexOf('for model "VerificationTokenModel"') !== -1) {
                    ErrorService.log('UserVerificationService.sendToken', error);
                } else if (error.message.indexOf('Airtable') !== -1) {
                    ErrorService.log('AirtableService.logUser', error);
                } else {
                    ErrorService.log('UserService.signup', error);
                }
                throw error;
            }
        } else {
            let error = new Error('Email is not in valid format.');
            error.code = 400;
            ErrorService.log('UserService.signup', error);
            throw error;
        }
    },
    getUserIpLocation: async function (clientIP) {
        var ipLocation;
        try {
            ipLocation = await iplocation(clientIP);
        } catch (error) {
            ipLocation = {};
        }
        return ipLocation;
    },

    //Description: login function to authenticate user.
    //Params:
    //Param 1: email: User email.
    //Param 2: password: User password.
    //Returns: promise.
    login: async function (email, password, clientIP) {
        var _this = this;
        if (util.isEmailValid(email)) {
            // find user if present in db.
            try {
                var user = await _this.findOneBy({ email: email });

                if (!user) {
                    let error = new Error('User does not exist.');
                    error.code = 400;
                    ErrorService.log('UserService.login', error);
                    throw error;
                } else {
                    var ipLocation = await _this.getUserIpLocation(clientIP);
                    await LoginIPLog.create({ userId: user._id, ipLocation });

                    if (user.paymentFailedDate) {
                        // calculate number of days the subscription renewal has failed.
                        var oneDayInMilliSeconds = 1000 * 60 * 60 * 24;
                        var daysAfterPaymentFailed = Math.round((new Date - user.paymentFailedDate) / oneDayInMilliSeconds);

                        if (daysAfterPaymentFailed >= 15) {
                            user = await _this.updateBy({ _id: user._id }, { disabled: true });

                            let error = new Error('Your account has been disabled. Kindly contact support@fyipe.com');
                            error.code = 400;
                            ErrorService.log('UserService.login', error);
                            throw error;
                        }
                    }
                    var encryptedPassword = user.password;

                    if (user.disabled) {
                        let error = new Error('Your account has been disabled. Kindly contact support@fyipe.com');
                        error.code = 400;
                        ErrorService.log('UserService.login', error);
                        throw error;
                    }
                    if (!user.isVerified) {
                        let error = new Error('Verify your email first.');
                        error.code = 401;
                        ErrorService.log('UserService.login', error);
                        throw error;
                    }
                    if (!encryptedPassword) {
                        let error = new Error('Your account does not exist. Please sign up.');
                        error.code = 400;
                        ErrorService.log('UserService.login', error);
                        throw error;
                    } else {
                        var res = await bcrypt.compare(password, encryptedPassword);

                        if (res) {
                            return user;
                        } else {
                            let error = new Error('Password is incorrect.');
                            error.code = 400;
                            ErrorService.log('UserService.login', error);
                            throw error;
                        }
                    }
                }
            } catch (error) {
                if (error.message === 'User does not exist.') {
                    ErrorService.log('UserService.findOneBy', error);
                } else if (error.message === 'Password is incorrect.') {
                    ErrorService.log('bcrypt.compare', error);
                } else {
                    ErrorService.log('UserService.login', error);
                }
                throw error;
            }
        } else {
            let error = new Error('Email is not in valid format.');
            error.code = 400;
            ErrorService.log('UserService.login', error);
            throw error;
        }
    },

    // Description: forgot password function
    //Params:
    //Param 1: email: User email.
    //Returns: promise.
    forgotPassword: async function (email) {
        var _this = this;
        try {
            if (util.isEmailValid(email)) {
                var user = await this.findOneBy({ email: email });

                if (!user) {
                    let error = new Error('User does not exist.');
                    error.code = 400;
                    ErrorService.log('UserService.forgotPassword', error);
                    throw error;
                } else {
                    var buf = await crypto.randomBytes(20);
                    var token = buf.toString('hex');

                    //update a user.
                    user = await _this.updateBy({
                        _id: user._id
                    }, {
                        resetPasswordToken: token,
                        resetPasswordExpires: Date.now() + 3600000 // 1 hour
                    });

                    return user;
                }
            } else {
                let error = new Error('Email is not in valid format.');
                error.code = 400;
                ErrorService.log('UserService.forgotPassword', error);
                throw error;
            }
        } catch (error) {
            if (error.message.indexOf('at path "email" for model "User"') !== -1 || error.message === 'User does not exist.') {
                ErrorService.log('UserService.findOneBy', error);
            } else {
                ErrorService.log('UserService.forgotPassword', error);
            }
            throw error;
        }

    },

    // Description: forgot password function.
    //Params:
    //Param 1:  password: User password.
    //Param 2:  token: token generated in forgot password function.
    //Returns: promise.
    resetPassword: async function (password, token) {
        var _this = this;
        try {
            var user = await _this.findOneBy({
                resetPasswordToken: token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            });

            if (!user) {
                return null;
            } else {
                var hash = await bcrypt.hash(password, constants.saltRounds);

                //update a user.
                user = await _this.updateBy({
                    _id: user._id
                }, {
                    password: hash,
                    resetPasswordToken: '',
                    resetPasswordExpires: ''
                });

                return user;
            }
        } catch (error) {
            if (error.message.indexOf('at path "resetPasswordToken" for model "User"') !== -1) {
                ErrorService.log('UserService.update', error);
            } else {
                ErrorService.log('UserService.resetPassword', error);
            }
            throw error;
        }
    },

    //Description: Get new access token.
    //Params:
    //Param 1:  refreshToken: Refresh token.
    //Returns: promise.
    getNewToken: async function (refreshToken) {
        var _this = this;
        try {
            var user = await _this.findOneBy({ jwtRefreshToken: refreshToken });

            if (!user) {
                let error = new Error('Invalid Refresh Token');
                error.code = 400;
                ErrorService.log('UserService.getNewToken', error);
                throw error;
            } else {
                var userObj = { id: user._id };

                var accessToken = `${jwt.sign(userObj, jwtKey.jwtSecretKey, { expiresIn: 86400 })}`;
                var jwtRefreshToken = randToken.uid(256);

                user = await _this.updateBy({ _id: user._id }, { jwtRefreshToken: jwtRefreshToken });

                var token = {
                    accessToken: accessToken,
                    refreshToken: refreshToken
                };
                return token;
            }
        } catch (error) {
            if (error.message.indexOf('at path "_id" for model "User"') !== -1) {
                ErrorService.log('UserService.update', error);
            } else {
                ErrorService.log('UserService.getNewToken', error);
            }
            throw error;
        }

    },

    changePassword: async function (data) {
        var _this = this;
        var currentPassword = data.currentPassword;
        try {
            var user = await _this.findOneBy({ _id: data._id });
            var encryptedPassword = user.password;

            var check = await bcrypt.compare(currentPassword, encryptedPassword);
            if (check) {
                var newPassword = data.newPassword;
                var hash = await bcrypt.hash(newPassword, constants.saltRounds);

                data.password = hash;
                user = await _this.updateBy({ _id: data._id }, data);

                return user;
            } else {
                let error = new Error('Current Password is incorrect.');
                error.code = 400;
                ErrorService.log('UserService.changePassword', error);
                throw error;
            }
        } catch (error) {
            if (error.message.indexOf('at path "_id" for model "User"') !== -1) {
                ErrorService.log('UserService.findOneBy', error);
            } else {
                ErrorService.log('UserService.changePassword', error);
            }
            throw error;
        }

    },

    getAllUsers: async function (skip, limit) {
        var _this = this;
        let users = await _this.findBy({ _id: { $ne: null }, deleted: { $ne: null } }, skip, limit);
        users = await Promise.all(users.map(async (user) => {
            // find user subprojects and parent projects
            var userProjects = await ProjectService.findBy({ 'users.userId': user._id });
            var parentProjectIds = [];
            var projectIds = [];
            if (userProjects.length > 0) {
                var subProjects = userProjects.map(project => project.parentProjectId ? project : null).filter(subProject => subProject !== null);
                parentProjectIds = subProjects.map(subProject => subProject.parentProjectId._id);
                var projects = userProjects.map(project => project.parentProjectId ? null : project).filter(project => project !== null);
                projectIds = projects.map(project => project._id);
            }
            userProjects = await ProjectService.findBy({ $or: [{ _id: { $in: parentProjectIds } }, { _id: { $in: projectIds } }] });
            return await Object.assign({}, user._doc, { projects: userProjects });
        }));
        return users;
    },

    restoreBy: async function (query) {
        const _this = this;
        query.deleted = true;

        let user = await _this.findBy(query);
        if (user && user.length > 1) {
            const users = await Promise.all(user.map(async (user) => {
                const userId = user._id;
                user = await _this.updateBy({
                    _id: userId
                }, {
                    deleted: false,
                    deletedBy: null,
                    deletedAt: null,
                });
                return user;
            }));
            return users;
        } else {
            user = user[0];
            if (user) {
                const userId = user._id;
                user = await _this.updateBy({
                    _id: userId
                }, {
                    deleted: false,
                    deletedBy: null,
                    deletedAt: null,
                });
            }
            return user;
        }
    },

    addNotes: async function (userId, notes) {
        const _this = this;
        let adminNotes = (await _this.updateBy({
            _id: userId
        }, {
            adminNotes: notes
        })).adminNotes;
        return adminNotes;
    },

    searchUsers: async function (query, skip, limit) {
        var _this = this;
        let users = await _this.findBy(query, skip, limit);
        users = await Promise.all(users.map(async (user) => {
            // find user subprojects and parent projects
            var userProjects = await ProjectService.findBy({ 'users.userId': user._id });
            var parentProjectIds = [];
            var projectIds = [];
            if (userProjects.length > 0) {
                var subProjects = userProjects.map(project => project.parentProjectId ? project : null).filter(subProject => subProject !== null);
                parentProjectIds = subProjects.map(subProject => subProject.parentProjectId._id);
                var projects = userProjects.map(project => project.parentProjectId ? null : project).filter(project => project !== null);
                projectIds = projects.map(project => project._id);
            }
            userProjects = await ProjectService.findBy({ $or: [{ _id: { $in: parentProjectIds } }, { _id: { $in: projectIds } }] });
            return await Object.assign({}, user._doc, { projects: userProjects });
        }));
        return users;
    },

    hardDeleteBy: async function (query) {
        try {
            await UserModel.deleteMany(query);
        } catch (error) {
            ErrorService.log('UserModel.deleteMany', error);
            throw error;
        }
        return 'User(s) Removed Successfully!';
    },

};

var bcrypt = require('bcrypt');
var constants = require('../config/constants.json');
var UserModel = require('../models/user');
var LoginIPLog = require('../models/LoginIPLog');
var util = require('./utilService.js');
var randToken = require('rand-token');
var PaymentService = require('./paymentService');
var crypto = require('crypto');
var ProjectService = require('./projectService');
var ErrorService = require('./errorService');
var jwt = require('jsonwebtoken');
var iplocation = require('iplocation').default;
var jwtKey = require('../config/keys');
var { BACKEND_HOST } = process.env;
var VerificationTokenModel = require('../models/verificationToken');
var MailService = require('../services/mailService');
var AirtableService = require('./airtableService');