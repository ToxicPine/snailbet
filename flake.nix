{
  description = "Scramjet local route proxy";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      denoDeps = pkgs.stdenvNoCC.mkDerivation {
        pname = "nestail-deno-deps";
        version = "0.1.0";
        src = self;

        nativeBuildInputs = [
          pkgs.deno
        ];

        buildPhase = ''
          runHook preBuild

          export DENO_DIR="$TMPDIR/deno-cache"
          deno cache \
            --vendor=true \
            --config deno.json \
            --lock deno.lock \
            src/server.ts

          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall

          mkdir -p "$out"
          cp -R node_modules "$out/"

          runHook postInstall
        '';

        outputHashAlgo = "sha256";
        outputHashMode = "recursive";
        outputHash = "sha256-Uig7I++85EUDp+5cnmQjwlDVSiEP75p8XXD1ofc90ks=";
      };
    in {
      packages.${system} = {
        nestail = pkgs.stdenvNoCC.mkDerivation {
          pname = "nestail";
          version = "0.1.0";
          src = self;

          nativeBuildInputs = [
            pkgs.makeWrapper
          ];

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/share/nestail" "$out/bin"
            cp -R deno.json deno.lock src "$out/share/nestail/"
            cp -R ${denoDeps}/node_modules "$out/share/nestail/"

            makeWrapper ${pkgs.deno}/bin/deno "$out/bin/nestail" \
              --add-flags "run" \
              --add-flags "--vendor=true" \
              --add-flags "--node-modules-dir=manual" \
              --add-flags "--config $out/share/nestail/deno.json" \
              --add-flags "--lock $out/share/nestail/deno.lock" \
              --add-flags "--allow-net=127.0.0.1,localhost" \
              --add-flags "--allow-env=SCRAMJET_HOST,SCRAMJET_PORT" \
              --add-flags "$out/share/nestail/src/server.ts"

            runHook postInstall
          '';
        };

        default = self.packages.${system}.nestail;
      };

      apps.${system}.default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/nestail";
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.deno
        ];
      };
    };
}
