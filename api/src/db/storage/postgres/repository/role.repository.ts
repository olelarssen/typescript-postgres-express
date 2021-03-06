import { Pool } from "pg";
import {IRoleServiceRepository} from "../../../interfaces/role.interface";
import {POSTGRES_SERVICE} from "../../../../services/app.constants";
import {Service} from "../../../../services/app.service";
import {ADMIN_ROLE_ID, RoleEntity, SUPERADMIN_ROLE_ID, USER_ROLE_ID} from "../../../entities/roles.entity";
import {ROLES_TABLE, USER_ROLE_TABLE, USERS_TABLE} from "./constants.repository";

/**
 * Role Repository.
 */
export class RoleRepository implements IRoleServiceRepository {
    private readonly database: Pool;
    private readonly usersTable: string;
    private readonly rolesTable: string;
    private readonly userRoleTable: string;
    constructor() {
        this.database = Service.getService<Pool>(POSTGRES_SERVICE);
        this.usersTable = USERS_TABLE;
        this.rolesTable = ROLES_TABLE;
        this.userRoleTable = USER_ROLE_TABLE;
    }

    private getOne(field: string, id: any): Promise<RoleEntity> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.database.query(`
                      SELECT ${this.rolesTable}.id,
                             ${this.rolesTable}.title,
                             ${this.rolesTable}.description,
                             ${this.rolesTable}.enabled,
                             ${this.rolesTable}.created,
                             ${this.rolesTable}.updated,
                             ${this.rolesTable}.removed,
                             array_remove(ARRAY_AGG(${this.usersTable}.id), NULL) ${this.usersTable}
                      FROM ${this.rolesTable}
                      LEFT JOIN ${this.userRoleTable} ON (${this.userRoleTable}.role_id = ${this.rolesTable}.id)
                      LEFT JOIN ${this.usersTable} ON (${this.usersTable}.id = ${this.userRoleTable}.user_id)

                      WHERE ${this.rolesTable}."${field}" = $1
                      GROUP BY ${this.rolesTable}.id ORDER BY id ASC`, [id]);
                const roles = result.rows.map(row => new RoleEntity(row.id, row.title, row.description, row.enabled, row.created, row.updated,
                    row.removed, row.users));
                if (roles && roles.length > 0) {
                    resolve(roles[0]);
                } else {
                    resolve(null);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * get all roles
     */
    public get(): Promise<RoleEntity[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.database.query(`
                      SELECT ${this.rolesTable}.id,
                             ${this.rolesTable}.title,
                             ${this.rolesTable}.description,
                             ${this.rolesTable}.enabled,
                             ${this.rolesTable}.created,
                             ${this.rolesTable}.updated,
                             ${this.rolesTable}.removed,
                             array_remove(ARRAY_AGG(${this.usersTable}.id), NULL) ${this.usersTable}
                      FROM ${this.rolesTable}
                      LEFT JOIN ${this.userRoleTable} ON (${this.userRoleTable}.role_id = ${this.rolesTable}.id)
                      LEFT JOIN ${this.usersTable} ON (${this.usersTable}.id = ${this.userRoleTable}.user_id)
                      GROUP BY ${this.rolesTable}.id ORDER BY id ASC`);
                resolve(result.rows.map(row => new RoleEntity(row.id, row.title, row.description, row.enabled, row.created, row.updated, row.removed, row.users)));
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Get all active roles
     */
    public getByEnabled(enabled: boolean): Promise<RoleEntity[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.database.query(`
                      SELECT ${this.rolesTable}.id,
                             ${this.rolesTable}.title,
                             ${this.rolesTable}.description,
                             ${this.rolesTable}.enabled,
                             ${this.rolesTable}.created,
                             ${this.rolesTable}.updated,
                             ${this.rolesTable}.removed,
                             array_remove(ARRAY_AGG(${this.usersTable}.id), NULL) ${this.usersTable}
                      FROM ${this.rolesTable}
                      LEFT JOIN ${this.userRoleTable} ON (${this.userRoleTable}.role_id = ${this.rolesTable}.id)
                      LEFT JOIN ${this.usersTable} ON (${this.usersTable}.id = ${this.userRoleTable}.user_id)

                      WHERE ${this.rolesTable}.enabled = $1
                      GROUP BY ${this.rolesTable}.id ORDER BY id ASC`, [enabled]);
                resolve(result.rows.map(row => new RoleEntity(row.id, row.title, row.description, row.enabled, row.created, row.updated, row.removed, row.users)));
            } catch (e) {
                reject(e);
            }
        });
    }

    public getById(id: number): Promise<RoleEntity> {
        return this.getOne("id", id);
    }

    public getByName(title: string): Promise<RoleEntity> {
        return this.getOne("title", title);
    }

    public update(role: RoleEntity): Promise<RoleEntity> {
        return new Promise(async (resolve, reject) => {
            // use combination of try catch to easily find an error
            try {
                const roleBeforeUpdate = await this.getById(role.id);
                if (roleBeforeUpdate && roleBeforeUpdate.enabled !== role.enabled) {
                    if (role.id === SUPERADMIN_ROLE_ID || role.id === ADMIN_ROLE_ID || role.id === USER_ROLE_ID) {
                        throw new Error(`${role.title} cannot be disabled`);
                    }
                }
                try {
                    await this.database.query(
                        `UPDATE ${this.rolesTable}
                     SET title = $2,
                         description = $3,
                         enabled = $4,
                         removed = $5
                     WHERE id = $1 RETURNING *;`,
                        [
                            role.id,
                            role.title,
                            role.description ? role.description : "",
                            !!role.enabled,
                            role.removed,
                        ]
                    );
                } catch (e) {
                    throw e;
                }
                try {
                    if (role && role.id) {
                        await this.database.query(`
                        DELETE
                        FROM ${this.userRoleTable}
                        WHERE role_id = $1`, [
                            role.id
                        ]);
                    }
                } catch (e) {
                    throw e;
                }
                try {
                    if (role && role.id && role.users) {
                        await Promise.all(role.users.map(async(userId) => {
                            if (userId) {
                                await this.database.query(`
                                INSERT INTO ${this.userRoleTable}
                                SELECT u.id, r.id
                                FROM ${this.rolesTable} r
                                         LEFT JOIN ${this.usersTable} u ON u.id = $1
                                WHERE r.id = $2`, [
                                    userId, role.id
                                ]);
                            }
                        }));
                    }
                } catch (e) {
                    throw e;
                }
                resolve(this.getById(role.id));
            } catch (e) {
                reject(e);
            }
        });
    }

    public remove(role: RoleEntity): Promise<RoleEntity> {
        return new Promise(async (resolve, reject) => {
            // use multiple try catch blocks for async operations
            try {
                if (role.id === SUPERADMIN_ROLE_ID || role.id === ADMIN_ROLE_ID || role.id === USER_ROLE_ID) {
                    throw new Error(`${role.title} cannot be deleted`);
                }
                try {
                    await this.database.query(`
                    DELETE FROM ${this.userRoleTable}
                    WHERE role_id = $1`, [
                        role.id
                    ]);
                } catch (e) {
                    throw e;
                }
                try {
                    if (process.env.NODE_ENV === "test") {
                        await this.database.query(
                            `DELETE FROM ${this.rolesTable}
                                 WHERE id = $1;`,
                            [
                                role.id
                            ]
                        );
                    } else {
                        await this.database.query(
                            `UPDATE ${this.rolesTable}
                             SET removed = NOW(),
                                 enabled = FALSE
                             WHERE id = $1 RETURNING *;`, [
                                role.id
                            ]);
                    }
                    role.removed = new Date();
                    role.enabled = false;
                    resolve(role);
                } catch (e) {
                    throw e;
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    public create(role: RoleEntity): Promise<RoleEntity> {
        return new Promise(async (resolve, reject) => {
            try {
                await this.database.query(
                    `INSERT INTO ${this.rolesTable} (title, description, enabled) VALUES ($1, $2, $3)`,
                    [
                        role.title,
                        role.description ? role.description : "",
                        true
                    ]
                );
                resolve(this.getByName(role.title));
            } catch (e) {
                reject(e);
            }
        });
    }

}
