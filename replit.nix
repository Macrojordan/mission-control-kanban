{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.postgresql
    pkgs.git
  ];

  # PostgreSQL setup for Replit
  env = {
    PGDATA = "$REPL_HOME/.pg/data";
    PGHOST = "localhost";
    PGPORT = "5432";
  };

  # Shell hook to ensure DB is ready
  shellHook = ''
    # Create PostgreSQL data directory if it doesn't exist
    if [ ! -d "$PGDATA" ]; then
      mkdir -p "$PGDATA"
      initdb -D "$PGDATA" --auth=trust --no-locale --encoding=UTF8
    fi

    # Start PostgreSQL if not running
    if ! pg_isready -q; then
      pg_ctl -D "$PGDATA" -l "$REPL_HOME/.pg/logfile" start
      sleep 2
    fi

    # Create database if it doesn't exist
    createdb mission_control 2>/dev/null || true

    echo "PostgreSQL ready on localhost:5432"
    echo "Database: mission_control"
  '';
}
