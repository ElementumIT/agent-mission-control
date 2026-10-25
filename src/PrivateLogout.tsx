export default function PrivateLogout() {
  if (!window.location.pathname.startsWith('/app')) return null
  return <form className="logout" method="post" action="/logout"><button type="submit">Log out</button></form>
}
