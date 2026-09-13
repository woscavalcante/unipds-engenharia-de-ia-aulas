const API_URL = 'http://localhost:3000/api/movies';

export class MovieService {
    async getMovies() {
        const response = await fetch(API_URL);
        return await response.json();
    }

    async getMovieById(id) {
        const movies = await this.getMovies();
        return movies.find(movie => movie.id === id);
    }

    async getMoviesByIds(ids) {
        const movies = await this.getMovies();
        return movies.filter(movie => ids.includes(movie.id));
    }
}
