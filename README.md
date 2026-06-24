# 🏋️ Brawnix: Backend API

The server-side API for **Brawnix**, a role-based fitness platform connecting
Users, Trainers, and Admins.

## 🔗 Live Links

- **Frontend:** [Brawnix](https://brawnix.vercel.app)
- **Backend API:** [Brawnix-Server](https://brawnix-server.vercel.app)

## 🛠️ Tech Stack

- **Node.js** + **Express.js**: REST API server
- **MongoDB** (native driver): database
- **Stripe**: payment processing
- **Better Auth** (session verification via cookies): authentication
- **CORS**, **cookie-parser**, **dotenv**: middleware & config

## ✨ What It Does

- Role-based access control for **User**, **Trainer**, and **Admin**
- Session verification via cookies, with a soft-block check for restricted
  accounts
- Fitness class management: submit, approve/reject, update, delete
- Class bookings with Stripe payment intent creation
- Favorites system for users
- Community forum: posts, comments, replies, likes/dislikes
- Trainer application & approval workflow
- Admin dashboard data: user/trainer counts, class status breakdown, booking
  stats

## 📂 Key Middleware

| Middleware                                     | Purpose                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `verifyToken`                                  | Validates session cookie, attaches `req.user` |
| `verifyUser` / `verifyTrainer` / `verifyAdmin` | Restricts routes by role                      |
| `checkNotBlocked`                              | Blocks write actions for suspended accounts   |

## 📌 Main Route Groups

- `/api/classes`: class listing, creation, moderation
- `/api/forum`: posts, likes, dislikes
- `/api/comments`: comments & replies
- `/api/bookings`: booking creation & cancellation
- `/api/favorites`: saved classes
- `/api/trainer-applications`: apply & review
- `/api/users`, `/api/trainers`: admin user management
- `/api/admin-stats`: dashboard analytics
- `/api/create-payment-intent`: Stripe payments

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- MongoDB connection URI
- Stripe secret key

### Installation

```bash
git clone <repository-url>
cd brawnix-server
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
FRONTEND_URL=http://localhost:3000
```

### Run the server

```bash
node index.js
```

Server runs at `http://localhost:5000`.
