export class UserController {
    #userService;
    #userView;
    #events;
    constructor({
        userView,
        userService,
        events,
    }) {
        this.#userView = userView;
        this.#userService = userService;
        this.#events = events;
    }

    static init(deps) {
        return new UserController(deps);
    }

    async renderUsers(nonTrainedUser) {
        const users = await this.#userService.getDefaultUsers();

        this.#userService.addUser(nonTrainedUser);
        const defaultAndNonTrained = [nonTrainedUser, ...users];

        this.#userView.renderUserOptions(defaultAndNonTrained);
        this.setupCallbacks();
        this.setupFavoriteObserver();

        this.#events.dispatchUsersUpdated({ users: defaultAndNonTrained });

    }

    setupCallbacks() {
        this.#userView.registerUserSelectCallback(this.handleUserSelect.bind(this));
        this.#userView.registerFavoriteRemoveCallback(this.handleFavoriteRemove.bind(this));
    }

    setupFavoriteObserver() {

        this.#events.onPurchaseAdded(
            async (...data) => {
                return this.handleFavoriteAdded(...data);
            }
        );

    }

    async handleUserSelect(userId) {
        const user = await this.#userService.getUserById(userId);
        this.#events.dispatchUserSelected(user);
        return this.displayUserDetails(user);
    }

    async handleFavoriteAdded({ user, product }) {
        const updatedUser = await this.#userService.getUserById(user.id);
        updatedUser.purchases.push({
            ...product
        })

        await this.#userService.updateUser(updatedUser);

        const lastFavorite = updatedUser.purchases[updatedUser.purchases.length - 1];
        this.#userView.addPastFavorite(lastFavorite);
        this.#events.dispatchUsersUpdated({ users: await this.#userService.getUsers() });
    }

    async handleFavoriteRemove({ userId, movie }) {
        const user = await this.#userService.getUserById(userId);
        const index = user.purchases.findIndex(item => item.id === movie.id);

        if (index !== -1) {
            user.purchases.splice(index, 1); // remove diretamente o item no índice encontrado
            await this.#userService.updateUser(user);

            const updatedUsers = await this.#userService.getUsers();
            this.#events.dispatchUsersUpdated({ users: updatedUsers });
        }
    }


    async displayUserDetails(user) {
        this.#userView.renderUserDetails(user);
        this.#userView.renderPastFavorites(user.purchases);

    }

    getSelectedUserId() {
        return this.#userView.getSelectedUserId();
    }
}
