import bcrypt from "bcrypt-nodejs";
import {UserRepository} from "../storage/postgres/repository/user.repository";
import {Service} from "../../services/app.service";
import {CONFIG_SERVICE, USER_REPOSITORY_SERVICE} from "../../services/app.constants";
import { Config } from "../../util/secrets";
export const ROOT_ID = 1;
type comparePasswordFunction = (candidatePassword: string, cb: (err: Error, isMatch: boolean) => (void)) => any;

export type PublicUser = {
        id: number;
        username: string;
        gravatar: string;
        email:    string;
        enabled:  boolean;
        removed:  boolean;
        expired:  number;
        token:    string;
        roles:    number[] | string[];
        accounts: number[] | string[];
}
export class UserEntity {
    public  comparePassword: comparePasswordFunction;
    public  save: () => Promise<UserEntity>;
    public  remove: () => Promise<UserEntity>;
    constructor(
        public readonly id: number,
        public          username: string,
        public          email:    string,
        public          password: string,
        public          enabled:  boolean,
        public          secret?: string,
        public readonly gravatar?: string,
        public          passwordResetToken?: string,
        public          passwordResetExpires?: number,
        public readonly created?:  Date,
        public readonly updated?:  Date,
        public          removed?:  Date,
        public          roles?:    number[],
        public          accounts?: number[]

) {
        this.comparePassword = function (candidatePassword, cb) {
            bcrypt.compare(candidatePassword, this.password, (err: Error, isMatch: boolean) => {
                cb(err, isMatch);
            });
        };

        this.save = function (): Promise<UserEntity> {
            return Service.getService<UserRepository>(USER_REPOSITORY_SERVICE).update(this);
        };

        this.remove = function (): Promise<UserEntity> {
            return Service.getService<UserRepository>(USER_REPOSITORY_SERVICE).remove(this);
        };
    }

    setSecret(secret: string): void {
        const config = Service.getService<Config>(CONFIG_SERVICE);
        if (this.username === config.testUser.username) {
            this.secret = config.testUser.secret;
        } else {
            this.secret = secret;
        }
    }
}
